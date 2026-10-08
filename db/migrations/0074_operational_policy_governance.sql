-- OWNED_BY: generic. Local schema approval recorded; no production activation.
BEGIN;
CREATE TABLE IF NOT EXISTS public.ops_policy_versions (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 kind text NOT NULL CHECK(kind IN ('administrative','clinical_template','authority','sprint')),
 scope text NOT NULL CHECK(length(trim(scope)) BETWEEN 1 AND 100),
 revision integer NOT NULL,
 payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'),
 state text NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','in_review','approved','active','retired')),
 created_by uuid NOT NULL REFERENCES public.user_profiles(id),
 reviewed_by uuid REFERENCES public.user_profiles(id),
 effective_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 approved_at timestamptz, activated_at timestamptz,
 UNIQUE(tenant_id,kind,scope,revision)
);
CREATE TABLE IF NOT EXISTS public.ops_policy_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 policy_id bigint NOT NULL REFERENCES public.ops_policy_versions(id),
 actor_id uuid NOT NULL, action text NOT NULL, reason text NOT NULL,
 happened_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.ops_policy_requests (
 tenant_id uuid NOT NULL REFERENCES public.tenants(id), request_key text NOT NULL,
 actor_id uuid NOT NULL, input jsonb NOT NULL, result jsonb NOT NULL,
 PRIMARY KEY(tenant_id,request_key)
);
CREATE OR REPLACE FUNCTION public.ops_actor(p_roles text[] DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r text; t uuid:=current_tenant_id();
BEGIN
 SELECT lower(role) INTO r FROM user_profiles WHERE id=auth.uid() AND tenant_id=t;
 IF auth.uid() IS NULL OR t IS NULL OR r IS NULL THEN RAISE EXCEPTION 'Login dan tenant aktif diperlukan'; END IF;
 IF p_roles IS NOT NULL AND NOT(r=ANY(p_roles)) THEN RAISE EXCEPTION 'Peran tidak berwenang'; END IF;
 RETURN auth.uid();
END $$;

CREATE OR REPLACE FUNCTION public.ops_validate_policy(p_kind text,p jsonb)
RETURNS void LANGUAGE plpgsql SET search_path=public AS $$
DECLARE f jsonb; keys text[]:='{}'; x jsonb;
BEGIN
 IF p IS NULL OR jsonb_typeof(p)<>'object' THEN RAISE EXCEPTION 'Konfigurasi wajib berupa object'; END IF;
 IF p_kind='administrative' THEN
  IF (p->>'room_method') IS NULL OR (p->>'room_method') NOT IN ('calendar','24_hour','hourly') OR (p->>'transfer_method') IS NULL OR (p->>'transfer_method') NOT IN ('prorata','highest','cutoff') OR (p->>'deposit_method') IS NULL OR (p->>'deposit_method') NOT IN ('fixed','percentage','none') THEN RAISE EXCEPTION 'Metode kamar/pindah/deposit wajib'; END IF;
  IF (p->>'timezone') IS NULL OR NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p->>'timezone') THEN RAISE EXCEPTION 'Timezone tidak valid'; END IF;
  IF p->>'room_method'='calendar' OR p->>'transfer_method'='cutoff' THEN
   IF coalesce(p->>'cutoff','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN RAISE EXCEPTION 'Cutoff HH:MM wajib'; END IF;
  END IF;
  IF (p->>'rounding') IS NULL OR p->>'rounding' NOT IN ('up','nearest','down') OR (p->>'minimum_units') IS NULL OR (p->>'minimum_units')::numeric<0 THEN RAISE EXCEPTION 'Pembulatan dan minimum wajib'; END IF;
  IF p->>'deposit_method'<>'none' AND ((p->>'deposit_value') IS NULL OR (p->>'deposit_value')::numeric<0) THEN RAISE EXCEPTION 'Nilai deposit wajib'; END IF;
  IF p->>'deposit_method'='percentage' AND (p->>'deposit_value')::numeric>100 THEN RAISE EXCEPTION 'Persentase maksimal 100'; END IF;
  IF p->>'payer_precedence' IS DISTINCT FROM 'explicit_contract_only' THEN RAISE EXCEPTION 'Prioritas kontrak eksplisit wajib'; END IF;
 ELSIF p_kind='clinical_template' THEN
  IF coalesce(length(trim(p->>'title')),0)<3 OR jsonb_typeof(p->'fields') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'fields')=0 THEN RAISE EXCEPTION 'Judul dan fields wajib'; END IF;
  FOR f IN SELECT value FROM jsonb_array_elements(p->'fields') LOOP
   IF coalesce(f->>'key','') !~ '^[a-z][a-z0-9_]{0,63}$' OR coalesce(length(trim(f->>'label')),0)=0 OR (f->>'type') IS NULL OR f->>'type' NOT IN ('text','number','date','boolean') OR jsonb_typeof(f->'required') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Definisi field tidak valid'; END IF;
   IF (f->>'key')=ANY(keys) THEN RAISE EXCEPTION 'Field duplikat'; END IF;
   keys:=array_append(keys,f->>'key');
  END LOOP;
  IF jsonb_typeof(p->'signer_roles') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'signer_roles')=0 THEN RAISE EXCEPTION 'Profesi penandatangan wajib'; END IF;
  FOR x IN SELECT value FROM jsonb_array_elements(p->'signer_roles') LOOP
   IF jsonb_typeof(x)<>'string' OR x#>>'{}' NOT IN ('dokter','doctor','nurse','perawat','midwife','bidan','pharmacist','apoteker','lab','analis','clinical_governance') THEN RAISE EXCEPTION 'Profesi penandatangan tidak valid'; END IF;
  END LOOP;
 ELSIF p_kind='authority' THEN
  IF jsonb_typeof(p->'rules') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'rules')=0 THEN RAISE EXCEPTION 'Aturan kewenangan wajib'; END IF;
  FOR f IN SELECT value FROM jsonb_array_elements(p->'rules') LOOP
   IF coalesce(length(trim(f->>'action')),0)=0 OR jsonb_typeof(f->'roles') IS DISTINCT FROM 'array' OR jsonb_array_length(f->'roles')=0 OR jsonb_typeof(f->'separate_verifier') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Action, roles dan separation wajib'; END IF;
   FOR x IN SELECT value FROM jsonb_array_elements(f->'roles') LOOP
    IF jsonb_typeof(x)<>'string' OR NOT EXISTS(SELECT 1 FROM public.roles WHERE kode=x#>>'{}') THEN RAISE EXCEPTION 'Role kewenangan tidak dikenal'; END IF;
    IF f->>'action' LIKE 'clinical.%' AND x#>>'{}' NOT IN ('dokter','doctor','nurse','perawat','midwife','bidan','pharmacist','apoteker','lab','analis','clinical_governance') THEN RAISE EXCEPTION 'Kewenangan klinis wajib profesi'; END IF;
   END LOOP;
   IF (f->>'action')=ANY(keys) THEN RAISE EXCEPTION 'Action duplikat'; END IF;
   keys:=array_append(keys,f->>'action');
  END LOOP;
 ELSIF p_kind='sprint' THEN
  IF (p->>'duration_days') IS NULL OR (p->>'duration_days')::integer NOT BETWEEN 1 AND 90 OR (p->>'velocity_window') IS NULL OR (p->>'velocity_window')::integer NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Durasi/window wajib'; END IF;
  IF jsonb_typeof(p->'points') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'points')=0 OR jsonb_typeof(p->'done_checks') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'done_checks')=0 OR p->>'carry_over' IS NULL OR p->>'carry_over' NOT IN ('backlog','next_planning') THEN RAISE EXCEPTION 'Skala, DoD dan carry-over wajib'; END IF;
  IF jsonb_typeof(p->'members') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'members')=0 THEN RAISE EXCEPTION 'Anggota tim wajib'; END IF;
  FOR x IN SELECT value FROM jsonb_array_elements(p->'members') LOOP
   IF jsonb_typeof(x)<>'string' OR NOT EXISTS(SELECT 1 FROM user_profiles WHERE id=(x#>>'{}')::uuid AND tenant_id=current_tenant_id() AND lower(role) IN ('super_admin','head_operation','direktur','tech')) THEN RAISE EXCEPTION 'Anggota harus dalam tenant aktif dan role Tech yang diizinkan'; END IF;
  END LOOP;
  FOR x IN SELECT value FROM jsonb_array_elements(p->'points') LOOP
   IF jsonb_typeof(x)<>'number' OR (x#>>'{}')::numeric<0 THEN RAISE EXCEPTION 'Poin harus numerik nonnegatif'; END IF;
  END LOOP;
  FOR x IN SELECT value FROM jsonb_array_elements(p->'done_checks') LOOP
   IF jsonb_typeof(x)<>'string' OR length(trim(x#>>'{}'))=0 THEN RAISE EXCEPTION 'DoD tidak boleh kosong'; END IF;
  END LOOP;
  IF (SELECT count(*)<>count(DISTINCT value) FROM jsonb_array_elements(p->'points')) OR (SELECT count(*)<>count(DISTINCT value) FROM jsonb_array_elements(p->'done_checks')) THEN RAISE EXCEPTION 'Skala/DoD duplikat'; END IF;
 ELSE RAISE EXCEPTION 'Jenis tidak dikenal'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.ops_policy_command(p_id bigint,p_action text,p_data jsonb,p_request_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a uuid; t uuid:=current_tenant_id(); v ops_policy_versions; q ops_policy_requests;
 inp jsonb:=jsonb_build_object('id',p_id,'action',p_action,'data',p_data); r jsonb; rev integer; why text;
BEGIN
 a:=ops_actor(ARRAY['super_admin','admin','admin_faskes','head_operation','direktur','clinical_governance','dokter','doctor','tech']);
 IF p_action IS NULL OR p_data IS NULL OR jsonb_typeof(p_data)<>'object' OR p_request_key IS NULL OR length(p_request_key) NOT BETWEEN 8 AND 150 THEN RAISE EXCEPTION 'Input/request key tidak valid'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(t::text||p_request_key));
 SELECT * INTO q FROM ops_policy_requests WHERE tenant_id=t AND request_key=p_request_key;
 IF FOUND THEN
  IF q.actor_id<>a OR q.input IS DISTINCT FROM inp THEN RAISE EXCEPTION 'Retry input/actor berbeda'; END IF;
  RETURN q.result;
 END IF;
 why:=trim(p_data->>'reason'); IF coalesce(length(why),0)<3 THEN RAISE EXCEPTION 'Alasan wajib'; END IF;
 IF p_action='create' THEN
  PERFORM ops_validate_policy(p_data->>'kind',p_data->'payload');
  PERFORM pg_advisory_xact_lock(hashtext(t::text||(p_data->>'kind')||(p_data->>'scope')));
  SELECT coalesce(max(revision),0)+1 INTO rev FROM ops_policy_versions WHERE tenant_id=t AND kind=p_data->>'kind' AND scope=p_data->>'scope';
  INSERT INTO ops_policy_versions(tenant_id,kind,scope,revision,payload,created_by)
  VALUES(t,p_data->>'kind',p_data->>'scope',rev,p_data->'payload',a) RETURNING * INTO v;
 ELSE
  SELECT * INTO v FROM ops_policy_versions WHERE id=p_id AND tenant_id=t FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Konfigurasi tidak ditemukan'; END IF;
  IF p_data->>'expected_state' IS DISTINCT FROM v.state THEN RAISE EXCEPTION 'Data berubah, muat ulang'; END IF;
  IF p_action='submit' AND v.state='draft' THEN
   UPDATE ops_policy_versions SET state='in_review' WHERE id=v.id RETURNING * INTO v;
  ELSIF p_action='approve' AND v.state='in_review' THEN
   IF a=v.created_by THEN RAISE EXCEPTION 'Reviewer harus berbeda dari pembuat'; END IF;
   IF v.kind='clinical_template' OR (v.kind='authority' AND EXISTS(SELECT 1 FROM jsonb_array_elements(v.payload->'rules') z WHERE z.value->>'action' LIKE 'clinical.%')) THEN PERFORM ops_actor(ARRAY['clinical_governance','doctor','dokter']);
   ELSE PERFORM ops_actor(ARRAY['super_admin','head_operation','direktur','admin_faskes']); END IF;
   UPDATE ops_policy_versions SET state='approved',reviewed_by=a,approved_at=now() WHERE id=v.id RETURNING * INTO v;
  ELSIF p_action='activate' AND v.state='approved' THEN
   PERFORM ops_actor(ARRAY['super_admin','head_operation','direktur','admin_faskes']);
   IF p_data->>'effective_at' IS NULL THEN RAISE EXCEPTION 'Tanggal berlaku wajib'; END IF;
   IF (p_data->>'effective_at')::timestamptz < now()-interval '1 minute' THEN RAISE EXCEPTION 'Tanggal berlaku tidak boleh retroaktif'; END IF;
   PERFORM ops_validate_policy(v.kind,v.payload);
   IF v.reviewed_by IS NULL OR v.reviewed_by=v.created_by THEN RAISE EXCEPTION 'Review sah diperlukan'; END IF;
   UPDATE ops_policy_versions SET state='active',effective_at=(p_data->>'effective_at')::timestamptz,activated_at=now() WHERE id=v.id RETURNING * INTO v;
  ELSIF p_action='retire' AND v.state IN ('approved','active') THEN
   PERFORM ops_actor(ARRAY['super_admin','head_operation','direktur','admin_faskes']);
   UPDATE ops_policy_versions SET state='retired' WHERE id=v.id RETURNING * INTO v;
  ELSE RAISE EXCEPTION 'Transisi tidak diizinkan'; END IF;
 END IF;
 INSERT INTO ops_policy_events(tenant_id,policy_id,actor_id,action,reason) VALUES(t,v.id,a,p_action,why);
 r:=to_jsonb(v);
 INSERT INTO ops_policy_requests VALUES(t,p_request_key,a,inp,r);
 RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.ops_active_policy(p_kind text,p_scope text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v ops_policy_versions;
BEGIN
 PERFORM ops_actor();
 SELECT * INTO v FROM ops_policy_versions WHERE tenant_id=current_tenant_id() AND kind=p_kind AND scope=p_scope AND state='active' AND effective_at<=now() ORDER BY effective_at DESC,revision DESC LIMIT 1;
 IF NOT FOUND THEN RAISE EXCEPTION 'Konfigurasi aktif belum tersedia: %/%',p_kind,p_scope; END IF;
 RETURN to_jsonb(v);
END $$;

CREATE OR REPLACE FUNCTION public.ops_assert_permission(p_scope text,p_action text,p_creator uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p jsonb;r jsonb;role_name text;
BEGIN
 PERFORM ops_actor();p:=ops_active_policy('authority',p_scope);
 SELECT value INTO r FROM jsonb_array_elements(p->'payload'->'rules') WHERE value->>'action'=p_action;
 SELECT lower(role) INTO role_name FROM user_profiles WHERE id=auth.uid() AND tenant_id=current_tenant_id();
 IF r IS NULL OR NOT(r->'roles' ? role_name) THEN RAISE EXCEPTION 'Kewenangan aksi belum disahkan'; END IF;
 IF (r->>'separate_verifier')::boolean AND p_creator=auth.uid() THEN RAISE EXCEPTION 'Verifikator harus berbeda dari pelaksana'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.ops_policy_staff()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r jsonb;
BEGIN
 PERFORM ops_actor(ARRAY['super_admin','admin','admin_faskes','head_operation','direktur','clinical_governance','dokter','doctor','tech']);
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',full_name,'role',role) ORDER BY full_name),'[]') INTO r FROM user_profiles WHERE tenant_id=current_tenant_id() AND lower(role) NOT IN ('patient','vendor','corporate','viewer');
 RETURN r;
END $$;

DO $$DECLARE n text; BEGIN
 FOREACH n IN ARRAY ARRAY['ops_policy_versions','ops_policy_events','ops_policy_requests'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',n);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',n);
 END LOOP;
END $$;
CREATE POLICY ops_policy_read ON public.ops_policy_versions FOR SELECT TO authenticated USING(tenant_id=current_tenant_id());
CREATE POLICY ops_policy_events_read ON public.ops_policy_events FOR SELECT TO authenticated USING(tenant_id=current_tenant_id());
GRANT SELECT ON public.ops_policy_versions,public.ops_policy_events TO authenticated;
REVOKE ALL ON FUNCTION public.ops_actor(text[]),public.ops_assert_permission(text,text,uuid),public.ops_validate_policy(text,jsonb),public.ops_policy_command(bigint,text,jsonb,text),public.ops_active_policy(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ops_policy_command(bigint,text,jsonb,text),public.ops_active_policy(text,text) TO authenticated;
REVOKE ALL ON FUNCTION public.ops_policy_staff() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ops_policy_staff() TO authenticated;
INSERT INTO public.role_pages(role_kode,page)
 SELECT kode,'cfg-rs-policy' FROM public.roles WHERE kode IN ('super_admin','admin','admin_faskes','head_operation','direktur','clinical_governance','dokter','doctor','tech')
 ON CONFLICT DO NOTHING;
COMMIT;
