-- OWNED_BY: generic. Existing admissions/master IDs remain unchanged.
BEGIN;
CREATE TABLE rs_encounter_lifecycle(admission_id bigint PRIMARY KEY REFERENCES admissions(id),tenant_id uuid NOT NULL REFERENCES tenants(id),cutover_at timestamptz NOT NULL,state text NOT NULL DEFAULT 'open' CHECK(state IN ('open','closed')),exit_kind text,closed_at timestamptz,closed_by uuid);
CREATE TABLE rs_care_episodes(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),admission_id bigint NOT NULL REFERENCES admissions(id),unit_code text NOT NULL REFERENCES rs_workflow_types(code),physical_unit_id bigint NOT NULL REFERENCES his_master_records(id),state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','active','transferred','completed')),previous_episode_id bigint REFERENCES rs_care_episodes(id),decision_record_id bigint REFERENCES rs_clinical_records(id),created_by uuid NOT NULL,accepted_by uuid,started_at timestamptz NOT NULL DEFAULT now(),accepted_at timestamptz,ended_at timestamptz,version integer NOT NULL DEFAULT 1,reason text NOT NULL);
CREATE UNIQUE INDEX rs_one_current_care_episode ON rs_care_episodes(admission_id) WHERE state IN ('pending','active');
CREATE TABLE rs_birth_links(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),mother_admission_id bigint NOT NULL REFERENCES admissions(id),child_admission_id bigint NOT NULL REFERENCES admissions(id),clinical_record_id bigint NOT NULL REFERENCES rs_clinical_records(id),recorded_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),amendment_of bigint REFERENCES rs_birth_links(id),state text NOT NULL DEFAULT 'active' CHECK(state IN ('active','amended')),reason text NOT NULL,CHECK(mother_admission_id<>child_admission_id));
CREATE UNIQUE INDEX rs_birth_child_active ON rs_birth_links(child_admission_id) WHERE state='active';
CREATE TABLE rs_episode_clinical_links(episode_id bigint NOT NULL REFERENCES rs_care_episodes(id),clinical_record_id bigint NOT NULL REFERENCES rs_clinical_records(id),tenant_id uuid NOT NULL REFERENCES tenants(id),observed_at timestamptz NOT NULL,linked_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(episode_id,clinical_record_id));
CREATE TABLE rs_episode_requests(tenant_id uuid NOT NULL REFERENCES tenants(id),request_key text NOT NULL,actor_id uuid NOT NULL,input jsonb NOT NULL,result jsonb NOT NULL,PRIMARY KEY(tenant_id,request_key));
CREATE TABLE rs_episode_events(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),episode_id bigint REFERENCES rs_care_episodes(id),actor_id uuid NOT NULL,action text NOT NULL,evidence jsonb NOT NULL,before_row jsonb,after_row jsonb,created_at timestamptz NOT NULL DEFAULT now());
CREATE FUNCTION rs_episode_command(p_action text,p_data jsonb,p_key text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid:=current_tenant_id();a uuid;req rs_episode_requests;ep rs_care_episodes;new_ep rs_care_episodes;decision rs_clinical_records;input_value jsonb:=jsonb_build_object('action',p_action,'data',p_data);result_value jsonb;before_value jsonb;unit_value text;admission_value bigint;physical_value bigint;cutover_value timestamptz;birth rs_birth_links;previous_birth rs_birth_links;
BEGIN
 a:=ops_actor(ARRAY['super_admin','head_operation','direktur','admin','admin_faskes','doctor','dokter','nurse','perawat','midwife','bidan','clinical_governance']);
 IF p_action IS NULL OR jsonb_typeof(p_data) IS DISTINCT FROM 'object' OR p_key IS NULL OR length(p_key) NOT BETWEEN 8 AND 150 OR coalesce(length(trim(p_data->>'reason')),0)<3 THEN RAISE EXCEPTION 'Input, alasan dan request key wajib';END IF;
 PERFORM pg_advisory_xact_lock(hashtext(t::text||'episode:'||p_key));SELECT * INTO req FROM rs_episode_requests WHERE tenant_id=t AND request_key=p_key;
 IF FOUND THEN IF req.actor_id<>a OR req.input IS DISTINCT FROM input_value THEN RAISE EXCEPTION 'Retry input/actor berbeda';END IF;RETURN req.result;END IF;
 IF p_action='open' THEN
  admission_value:=(p_data->>'admission_id')::bigint;unit_value:=p_data->>'unit';physical_value:=(p_data->>'physical_unit_id')::bigint;cutover_value:=(p_data->>'cutover_at')::timestamptz;
  PERFORM 1 FROM admissions WHERE id=admission_value AND tenant_id=t FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'Kunjungan bukan milik tenant';END IF;
  IF EXISTS(SELECT 1 FROM rs_encounter_lifecycle WHERE admission_id=admission_value AND state='closed') THEN RAISE EXCEPTION 'Encounter tertutup; kunjungan ulang wajib admission baru';END IF;
  IF EXISTS(SELECT 1 FROM inpatient_stays WHERE admission_id=admission_value AND status<>'Dirawat') AND NOT EXISTS(SELECT 1 FROM inpatient_stays WHERE admission_id=admission_value AND status='Dirawat') THEN RAISE EXCEPTION 'Kunjungan rawat inap sumber sudah selesai; kunjungan ulang wajib admission baru';END IF;
  PERFORM ops_assert_permission(unit_value,'episode.open');
  IF cutover_value IS NULL OR cutover_value<now()-interval '1 minute' OR cutover_value>now()+interval '1 minute' THEN RAISE EXCEPTION 'Cutover eksplisit saat ini wajib; histori lama tidak direkonstruksi';END IF;
  IF unit_value NOT IN ('rs-igd-flow','rs-critical-care','rs-operating-room','rs-maternity','rs-day-care','rs-nurse-station') OR NOT EXISTS(SELECT 1 FROM rs_workflow_types WHERE code=unit_value) THEN RAISE EXCEPTION 'Unit pelayanan tidak valid';END IF;
  IF NOT EXISTS(SELECT 1 FROM his_master_records WHERE id=physical_value AND tenant_id=t AND domain_key='unit_room' AND status='active' AND (effective_from IS NULL OR effective_from<=current_date) AND (effective_to IS NULL OR effective_to>=current_date)) THEN RAISE EXCEPTION 'Unit fisik aktif milik tenant wajib';END IF;
  INSERT INTO rs_encounter_lifecycle(admission_id,tenant_id,cutover_at) VALUES(admission_value,t,cutover_value) ON CONFLICT(admission_id) DO NOTHING;
  INSERT INTO rs_care_episodes(tenant_id,admission_id,unit_code,physical_unit_id,created_by,started_at,reason) VALUES(t,admission_value,unit_value,physical_value,a,cutover_value,p_data->>'reason') RETURNING * INTO ep;result_value:=to_jsonb(ep);
 ELSIF p_action='link_birth' THEN
  PERFORM ops_actor(ARRAY['doctor','dokter','midwife','bidan','clinical_governance']);PERFORM ops_assert_permission('rs-maternity','clinical.episode.link_birth');
  SELECT * INTO decision FROM rs_clinical_records WHERE id=(p_data->>'clinical_record_id')::bigint AND tenant_id=t AND signed_at IS NOT NULL;
  IF NOT FOUND OR decision.admission_id IS DISTINCT FROM (p_data->>'mother_admission_id')::bigint OR decision.form_values->>'child_admission_id' IS DISTINCT FROM p_data->>'child_admission_id' OR decision.form_values->'birth_identity_verified' IS DISTINCT FROM 'true'::jsonb OR NOT EXISTS(SELECT 1 FROM ops_policy_versions WHERE id=decision.policy_id AND scope='rs-maternity') THEN RAISE EXCEPTION 'Catatan persalinan sah dan identitas bayi wajib';END IF;
  IF NOT EXISTS(SELECT 1 FROM admissions WHERE id=(p_data->>'child_admission_id')::bigint AND tenant_id=t) THEN RAISE EXCEPTION 'Admission bayi harus terpisah dan milik tenant';END IF;
  IF EXISTS(SELECT 1 FROM rs_birth_links WHERE state='active' AND (child_admission_id=(p_data->>'mother_admission_id')::bigint OR mother_admission_id=(p_data->>'child_admission_id')::bigint)) THEN RAISE EXCEPTION 'Relasi ibu-bayi bersiklus tidak diizinkan';END IF;
  IF EXISTS(SELECT 1 FROM rs_clinical_records WHERE amendment_of=decision.id AND signed_at IS NOT NULL) THEN RAISE EXCEPTION 'Catatan sumber sudah diamend';END IF;
  IF p_data->>'amendment_of' IS NOT NULL THEN
   SELECT * INTO previous_birth FROM rs_birth_links WHERE id=(p_data->>'amendment_of')::bigint AND tenant_id=t AND state='active' FOR UPDATE;
   IF NOT FOUND OR previous_birth.mother_admission_id IS DISTINCT FROM decision.admission_id OR decision.amendment_of IS DISTINCT FROM previous_birth.clinical_record_id THEN RAISE EXCEPTION 'Koreksi relasi wajib amendment klinis sumber yang sama';END IF;
   before_value:=to_jsonb(previous_birth);UPDATE rs_birth_links SET state='amended' WHERE id=previous_birth.id;
  END IF;
  INSERT INTO rs_birth_links(tenant_id,mother_admission_id,child_admission_id,clinical_record_id,recorded_by,amendment_of,reason) VALUES(t,(p_data->>'mother_admission_id')::bigint,(p_data->>'child_admission_id')::bigint,decision.id,a,previous_birth.id,p_data->>'reason') RETURNING * INTO birth;result_value:=to_jsonb(birth);
 ELSE
  SELECT admission_id INTO admission_value FROM rs_care_episodes WHERE id=(p_data->>'id')::bigint AND tenant_id=t;
  IF NOT FOUND THEN RAISE EXCEPTION 'Episode tidak ditemukan';END IF;
  PERFORM 1 FROM admissions WHERE id=admission_value AND tenant_id=t FOR UPDATE;
  SELECT * INTO ep FROM rs_care_episodes WHERE id=(p_data->>'id')::bigint AND tenant_id=t FOR UPDATE;before_value:=to_jsonb(ep);
  IF ep.version IS DISTINCT FROM (p_data->>'version')::integer THEN RAISE EXCEPTION 'Data berubah; muat ulang';END IF;
  PERFORM ops_assert_permission(ep.unit_code,'clinical.episode.'||p_action,ep.created_by);
  PERFORM ops_actor(ARRAY['doctor','dokter','nurse','perawat','midwife','bidan','clinical_governance']);
  IF p_action='accept' AND ep.state='pending' THEN
   IF ep.created_by=a THEN RAISE EXCEPTION 'Penerima handover harus berbeda';END IF;
   UPDATE rs_care_episodes SET state='active',accepted_by=a,accepted_at=now(),version=version+1 WHERE id=ep.id RETURNING * INTO ep;result_value:=to_jsonb(ep);
  ELSIF p_action IN ('transfer','close') AND ep.state='active' THEN
   SELECT * INTO decision FROM rs_clinical_records WHERE id=(p_data->>'clinical_record_id')::bigint AND tenant_id=t AND admission_id=ep.admission_id AND signed_at IS NOT NULL;
   IF NOT FOUND OR decision.created_at<ep.started_at OR NOT EXISTS(SELECT 1 FROM ops_policy_versions WHERE id=decision.policy_id AND scope=ep.unit_code) OR EXISTS(SELECT 1 FROM rs_clinical_records WHERE amendment_of=decision.id AND signed_at IS NOT NULL) THEN RAISE EXCEPTION 'Keputusan klinis sah scope episode wajib';END IF;
   IF p_action='transfer' THEN
    unit_value:=p_data->>'unit';physical_value:=(p_data->>'physical_unit_id')::bigint;
    IF decision.form_values->>'transfer_target' IS DISTINCT FROM unit_value OR unit_value NOT IN ('rs-igd-flow','rs-critical-care','rs-operating-room','rs-maternity','rs-day-care','rs-nurse-station') OR unit_value=ep.unit_code AND physical_value=ep.physical_unit_id THEN RAISE EXCEPTION 'Tujuan transfer harus sesuai keputusan klinis dan berbeda';END IF;
    PERFORM ops_assert_permission(unit_value,'episode.open');
    IF NOT EXISTS(SELECT 1 FROM his_master_records WHERE id=physical_value AND tenant_id=t AND domain_key='unit_room' AND status='active' AND (effective_from IS NULL OR effective_from<=current_date) AND (effective_to IS NULL OR effective_to>=current_date)) THEN RAISE EXCEPTION 'Unit fisik tujuan tidak valid';END IF;
    UPDATE rs_care_episodes SET state='transferred',ended_at=now(),decision_record_id=decision.id,version=version+1 WHERE id=ep.id RETURNING * INTO ep;
    INSERT INTO rs_care_episodes(tenant_id,admission_id,unit_code,physical_unit_id,previous_episode_id,decision_record_id,created_by,reason) VALUES(t,ep.admission_id,unit_value,physical_value,ep.id,decision.id,a,p_data->>'reason') RETURNING * INTO new_ep;result_value:=jsonb_build_object('from',to_jsonb(ep),'to',to_jsonb(new_ep));
   ELSE
    IF p_data->>'exit_kind' IS NULL OR p_data->>'exit_kind' NOT IN ('discharge','referral','death','dama') OR decision.form_values->>'exit_kind' IS DISTINCT FROM p_data->>'exit_kind' THEN RAISE EXCEPTION 'Jenis keluar harus sesuai keputusan klinis';END IF;
    IF EXISTS(SELECT 1 FROM inpatient_stays WHERE admission_id=ep.admission_id AND status='Dirawat') THEN RAISE EXCEPTION 'Selesaikan pemulangan rawat inap sumber sebelum menutup encounter';END IF;
    IF EXISTS(SELECT 1 FROM rs_work_orders WHERE admission_id=ep.admission_id AND tenant_id=t AND status='active') THEN RAISE EXCEPTION 'Tugas aktif harus diselesaikan atau ditutup beralasan';END IF;
    UPDATE rs_care_episodes SET state='completed',ended_at=now(),decision_record_id=decision.id,version=version+1 WHERE id=ep.id RETURNING * INTO ep;
    UPDATE rs_encounter_lifecycle SET state='closed',exit_kind=p_data->>'exit_kind',closed_at=now(),closed_by=a WHERE admission_id=ep.admission_id;result_value:=to_jsonb(ep);
   END IF;
  ELSIF p_action='attach' AND ep.state='active' THEN
   SELECT * INTO decision FROM rs_clinical_records WHERE id=(p_data->>'clinical_record_id')::bigint AND tenant_id=t AND admission_id=ep.admission_id AND signed_at IS NOT NULL;
   IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM ops_policy_versions WHERE id=decision.policy_id AND scope=ep.unit_code) OR EXISTS(SELECT 1 FROM rs_clinical_records WHERE amendment_of=decision.id AND signed_at IS NOT NULL) THEN RAISE EXCEPTION 'Catatan sah terkini pada kunjungan/scope episode wajib';END IF;
   IF (p_data->>'observed_at')::timestamptz IS NULL OR (p_data->>'observed_at')::timestamptz<ep.started_at OR (p_data->>'observed_at')::timestamptz>now() THEN RAISE EXCEPTION 'Waktu observasi harus berada dalam episode';END IF;
   INSERT INTO rs_episode_clinical_links VALUES(ep.id,decision.id,t,(p_data->>'observed_at')::timestamptz,a,now());result_value:=jsonb_build_object('ok',true,'episode_id',ep.id,'clinical_record_id',decision.id);
  ELSE RAISE EXCEPTION 'Transisi episode tidak sah';END IF;
 END IF;
 INSERT INTO rs_episode_events(tenant_id,episode_id,actor_id,action,evidence,before_row,after_row) VALUES(t,ep.id,a,p_action,p_data,before_value,result_value);
 INSERT INTO rs_episode_requests VALUES(t,p_key,a,input_value,result_value);RETURN result_value;
END $$;
DO $$DECLARE n text;BEGIN FOREACH n IN ARRAY ARRAY['rs_encounter_lifecycle','rs_care_episodes','rs_birth_links','rs_episode_clinical_links','rs_episode_requests','rs_episode_events'] LOOP EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',n);EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,anon,authenticated',n);END LOOP;END $$;
CREATE POLICY rs_care_episode_read ON rs_care_episodes FOR SELECT TO authenticated USING(tenant_id=current_tenant_id() AND rs_can_read(unit_code));
CREATE POLICY rs_episode_link_read ON rs_episode_clinical_links FOR SELECT TO authenticated USING(tenant_id=current_tenant_id() AND EXISTS(SELECT 1 FROM rs_care_episodes WHERE id=episode_id AND rs_can_read(unit_code)));
CREATE POLICY rs_encounter_life_read ON rs_encounter_lifecycle FOR SELECT TO authenticated USING(tenant_id=current_tenant_id() AND EXISTS(SELECT 1 FROM rs_care_episodes WHERE admission_id=rs_encounter_lifecycle.admission_id AND rs_can_read(unit_code)));
CREATE POLICY rs_birth_link_read ON rs_birth_links FOR SELECT TO authenticated USING(tenant_id=current_tenant_id() AND rs_can_read('rs-maternity'));
GRANT SELECT ON rs_care_episodes,rs_episode_clinical_links,rs_encounter_lifecycle,rs_birth_links TO authenticated;
REVOKE ALL ON FUNCTION rs_episode_command(text,jsonb,text) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION rs_episode_command(text,jsonb,text) TO authenticated;
CREATE FUNCTION rs_episode_board(p_admission_id bigint DEFAULT NULL,p_offset integer DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid:=current_tenant_id();rows_value jsonb;ids bigint[];
BEGIN
 PERFORM ops_actor(ARRAY['super_admin','head_operation','direktur','admin','admin_faskes','doctor','dokter','nurse','perawat','midwife','bidan','clinical_governance']);
 IF p_offset IS NULL OR p_offset<0 OR p_offset>1000000 THEN RAISE EXCEPTION 'Offset tidak valid';END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(r)),'[]'),array_agg(r.id) INTO rows_value,ids FROM (SELECT e.*,a.patient_name,a.mr_number,a.visit_number,(SELECT count(*) FROM rs_work_orders o WHERE o.tenant_id=t AND o.admission_id=e.admission_id AND o.status='active') pending_work FROM rs_care_episodes e JOIN admissions a ON a.id=e.admission_id WHERE e.tenant_id=t AND rs_can_read(e.unit_code) AND (p_admission_id IS NULL OR e.admission_id=p_admission_id) ORDER BY e.id DESC LIMIT 51 OFFSET p_offset)r;
 RETURN jsonb_build_object('episodes',rows_value,
 'admissions',coalesce((SELECT jsonb_agg(to_jsonb(a)) FROM (SELECT id,visit_number,patient_name,mr_number FROM admissions WHERE tenant_id=t AND (p_admission_id IS NULL OR id=p_admission_id) ORDER BY id DESC LIMIT 200)a),'[]'),
 'units',coalesce((SELECT jsonb_agg(jsonb_build_object('code',code,'label',label)) FROM rs_workflow_types WHERE code IN ('rs-igd-flow','rs-critical-care','rs-operating-room','rs-maternity','rs-day-care','rs-nurse-station') AND rs_can_read(code)),'[]'),
 'rooms',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name)) FROM his_master_records WHERE tenant_id=t AND domain_key='unit_room' AND status='active' AND (effective_from IS NULL OR effective_from<=current_date) AND (effective_to IS NULL OR effective_to>=current_date)),'[]'),
 'records',coalesce((SELECT jsonb_agg(to_jsonb(c)) FROM (SELECT c.id,c.admission_id,p.scope,p.payload->>'title' title,c.signed_at,c.created_at,c.amendment_of FROM rs_clinical_records c JOIN ops_policy_versions p ON p.id=c.policy_id WHERE c.tenant_id=t AND c.signed_at IS NOT NULL AND rs_can_read(p.scope) AND c.admission_id IN (SELECT admission_id FROM rs_care_episodes WHERE id=ANY(ids)) ORDER BY c.id DESC LIMIT 200)c),'[]'),
 'links',coalesce((SELECT jsonb_agg(to_jsonb(l)) FROM rs_episode_clinical_links l WHERE l.tenant_id=t AND l.episode_id=ANY(ids)),'[]'),
 'birth_links',coalesce((SELECT jsonb_agg(to_jsonb(b)) FROM (SELECT * FROM rs_birth_links b WHERE b.tenant_id=t AND rs_can_read('rs-maternity') AND (p_admission_id IS NULL OR b.mother_admission_id=p_admission_id OR b.child_admission_id=p_admission_id) ORDER BY b.id DESC LIMIT 200)b),'[]'));
END $$;
REVOKE ALL ON FUNCTION rs_episode_board(bigint,integer) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION rs_episode_board(bigint,integer) TO authenticated;
COMMIT;
