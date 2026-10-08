-- OWNED_BY: generic. Versioned form records anchored to existing admissions.
BEGIN;
CREATE TABLE public.rs_clinical_records (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),
 admission_id bigint NOT NULL REFERENCES admissions(id),policy_id bigint NOT NULL REFERENCES ops_policy_versions(id),
 form_values jsonb NOT NULL CHECK(jsonb_typeof(form_values)='object'),
 amendment_of bigint REFERENCES rs_clinical_records(id),reason text NOT NULL,
 created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 signed_by uuid,signed_at timestamptz
);
CREATE TABLE public.rs_clinical_requests (
 tenant_id uuid NOT NULL REFERENCES tenants(id),request_key text NOT NULL,actor_id uuid NOT NULL,
 input jsonb NOT NULL,result jsonb NOT NULL,PRIMARY KEY(tenant_id,request_key)
);
CREATE TABLE public.rs_clinical_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),
 record_id bigint NOT NULL REFERENCES rs_clinical_records(id),actor_id uuid NOT NULL,action text NOT NULL,
 happened_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION public.rs_clinical_command(p_action text,p_data jsonb,p_request_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid:=current_tenant_id();a uuid;r rs_clinical_records;oldr rs_clinical_records;
 p ops_policy_versions;q rs_clinical_requests;f jsonb;v jsonb;k text;keys text[]:='{}';role_name text;
 inp jsonb:=jsonb_build_object('action',p_action,'data',p_data);res jsonb;
BEGIN
 a:=ops_actor(ARRAY['dokter','doctor','nurse','perawat','midwife','bidan','pharmacist','apoteker','lab','analis','clinical_governance']);
 IF p_action IS NULL OR p_data IS NULL OR jsonb_typeof(p_data)<>'object' OR p_request_key IS NULL OR length(p_request_key) NOT BETWEEN 8 AND 150 THEN RAISE EXCEPTION 'Input/request key tidak valid'; END IF;
 IF coalesce(length(trim(p_data->>'reason')),0)<3 THEN RAISE EXCEPTION 'Alasan wajib'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(t::text||p_request_key));
 SELECT * INTO q FROM rs_clinical_requests WHERE tenant_id=t AND request_key=p_request_key;
 IF FOUND THEN IF q.actor_id<>a OR q.input IS DISTINCT FROM inp THEN RAISE EXCEPTION 'Retry input/actor berbeda'; END IF;RETURN q.result;END IF;
 IF p_action='record' THEN
  IF NOT EXISTS(SELECT 1 FROM admissions WHERE id=(p_data->>'admission_id')::bigint AND tenant_id=t) THEN RAISE EXCEPTION 'Kunjungan bukan milik tenant'; END IF;
  SELECT * INTO p FROM ops_policy_versions WHERE id=(p_data->>'policy_id')::bigint AND tenant_id=t AND kind='clinical_template' AND state='active' AND effective_at<=now();
  IF NOT FOUND THEN RAISE EXCEPTION 'Template klinis aktif wajib'; END IF;
  PERFORM ops_assert_permission(p.scope,'clinical.record');
  IF coalesce(length(trim(p_data->>'reason')),0)<3 OR jsonb_typeof(p_data->'values') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Alasan dan isian wajib'; END IF;
  FOR f IN SELECT value FROM jsonb_array_elements(p.payload->'fields') LOOP
   k:=f->>'key';keys:=array_append(keys,k);v:=p_data->'values'->k;
   IF (f->>'required')::boolean AND (v IS NULL OR v='null'::jsonb OR (jsonb_typeof(v)='string' AND length(trim(v#>>'{}'))=0)) THEN RAISE EXCEPTION 'Isian wajib: %',k; END IF;
   IF v IS NOT NULL AND v<>'null'::jsonb THEN
    IF (f->>'type'='number' AND jsonb_typeof(v)<>'number') OR (f->>'type'='boolean' AND jsonb_typeof(v)<>'boolean') OR (f->>'type' IN ('text','date') AND jsonb_typeof(v)<>'string') THEN RAISE EXCEPTION 'Jenis isian tidak sesuai: %',k; END IF;
    IF f->>'type'='date' THEN PERFORM (v#>>'{}')::date; END IF;
   END IF;
  END LOOP;
  FOR k IN SELECT jsonb_object_keys(p_data->'values') LOOP IF NOT(k=ANY(keys)) THEN RAISE EXCEPTION 'Field tidak dikenal: %',k; END IF;END LOOP;
  IF p_data->>'amendment_of' IS NOT NULL THEN
   SELECT * INTO oldr FROM rs_clinical_records WHERE id=(p_data->>'amendment_of')::bigint AND tenant_id=t;
   IF NOT FOUND OR oldr.admission_id IS DISTINCT FROM (p_data->>'admission_id')::bigint OR oldr.signed_at IS NULL THEN RAISE EXCEPTION 'Amendment harus merujuk catatan sah pada kunjungan yang sama'; END IF;
   IF (SELECT scope FROM ops_policy_versions WHERE id=oldr.policy_id) IS DISTINCT FROM p.scope THEN RAISE EXCEPTION 'Scope amendment harus sama'; END IF;
  END IF;
  INSERT INTO rs_clinical_records(tenant_id,admission_id,policy_id,form_values,amendment_of,reason,created_by)
   VALUES(t,(p_data->>'admission_id')::bigint,p.id,p_data->'values',(p_data->>'amendment_of')::bigint,p_data->>'reason',a) RETURNING * INTO r;
 ELSIF p_action='sign' THEN
  SELECT * INTO r FROM rs_clinical_records WHERE id=(p_data->>'id')::bigint AND tenant_id=t FOR UPDATE;
  IF NOT FOUND OR r.signed_at IS NOT NULL THEN RAISE EXCEPTION 'Catatan tidak ditemukan atau sudah disahkan'; END IF;
  SELECT * INTO p FROM ops_policy_versions WHERE id=r.policy_id AND tenant_id=t;
  SELECT lower(role) INTO role_name FROM user_profiles WHERE id=a AND tenant_id=t;
  IF NOT(p.payload->'signer_roles' ? role_name) THEN RAISE EXCEPTION 'Profesi tidak berwenang mengesahkan formulir'; END IF;
  PERFORM ops_assert_permission(p.scope,'clinical.sign',r.created_by);
  -- A record retains its approved version even if a replacement becomes active.
  UPDATE rs_clinical_records SET signed_by=a,signed_at=now() WHERE id=r.id RETURNING * INTO r;
 ELSE RAISE EXCEPTION 'Aksi tidak dikenal'; END IF;
 INSERT INTO rs_clinical_events(tenant_id,record_id,actor_id,action) VALUES(t,r.id,a,p_action);
 res:=to_jsonb(r);INSERT INTO rs_clinical_requests VALUES(t,p_request_key,a,inp,res);RETURN res;
END $$;
ALTER TABLE rs_clinical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE rs_clinical_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE rs_clinical_events ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.rs_clinical_can_read(p_policy_id bigint)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(
  SELECT 1 FROM ops_policy_versions template JOIN user_profiles u ON u.id=auth.uid() AND u.tenant_id=current_tenant_id()
  JOIN LATERAL (SELECT payload FROM ops_policy_versions WHERE tenant_id=current_tenant_id() AND kind='authority' AND scope=template.scope AND state='active' AND effective_at<=now() ORDER BY effective_at DESC,revision DESC LIMIT 1) authority ON true
  CROSS JOIN LATERAL jsonb_array_elements(authority.payload->'rules') rule
  WHERE template.id=p_policy_id AND template.tenant_id=current_tenant_id() AND template.kind='clinical_template'
   AND rule->>'action' IN ('clinical.record','clinical.sign','clinical.read') AND rule->'roles' ? lower(u.role)
 );
$$;
CREATE POLICY rs_clinical_read ON rs_clinical_records FOR SELECT TO authenticated USING(tenant_id=current_tenant_id() AND rs_clinical_can_read(policy_id));
CREATE POLICY rs_clinical_event_read ON rs_clinical_events FOR SELECT TO authenticated USING(tenant_id=current_tenant_id() AND EXISTS(SELECT 1 FROM rs_clinical_records WHERE id=record_id));
REVOKE ALL ON rs_clinical_records,rs_clinical_requests,rs_clinical_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON rs_clinical_records,rs_clinical_events TO authenticated;
REVOKE ALL ON FUNCTION rs_clinical_command(text,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION rs_clinical_command(text,jsonb,text) TO authenticated;
REVOKE ALL ON FUNCTION rs_clinical_can_read(bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION rs_clinical_can_read(bigint) TO authenticated;
INSERT INTO role_pages(role_kode,page)
 SELECT kode,'rs-clinical-forms' FROM roles WHERE kode IN ('dokter','doctor','nurse','perawat','midwife','bidan','pharmacist','apoteker','lab','analis','clinical_governance') ON CONFLICT DO NOTHING;
COMMIT;
