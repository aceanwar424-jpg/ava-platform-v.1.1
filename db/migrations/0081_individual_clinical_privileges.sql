-- OWNED_BY: generic. Operational credentials reference existing user IDs; no master identity changes.
BEGIN;
CREATE TABLE ops_professional_credentials(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),user_id uuid NOT NULL REFERENCES user_profiles(id),kind text NOT NULL CHECK(kind IN ('STR','SIP','professional_authorization')),reference text NOT NULL,evidence text NOT NULL,valid_from date NOT NULL,valid_until date NOT NULL,state text NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','in_review','verified','revoked')),created_by uuid NOT NULL,reviewed_by uuid,version integer NOT NULL DEFAULT 1,reason text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),reviewed_at timestamptz,CHECK(valid_until>=valid_from));
CREATE TABLE ops_individual_privileges(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),user_id uuid NOT NULL REFERENCES user_profiles(id),scope text NOT NULL,actions jsonb NOT NULL CHECK(jsonb_typeof(actions)='array'),credential_ids bigint[] NOT NULL,valid_from date NOT NULL,valid_until date NOT NULL,evidence text NOT NULL,state text NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','in_review','verified','revoked')),created_by uuid NOT NULL,reviewed_by uuid,version integer NOT NULL DEFAULT 1,reason text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),reviewed_at timestamptz,CHECK(valid_until>=valid_from));
CREATE TABLE ops_workforce_requests(tenant_id uuid NOT NULL REFERENCES tenants(id),request_key text NOT NULL,actor_id uuid NOT NULL,input jsonb NOT NULL,result jsonb NOT NULL,PRIMARY KEY(tenant_id,request_key));
CREATE TABLE ops_workforce_events(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),entity text NOT NULL,entity_id bigint NOT NULL,actor_id uuid NOT NULL,action text NOT NULL,reason text NOT NULL,before_row jsonb,after_row jsonb,created_at timestamptz NOT NULL DEFAULT now());
CREATE FUNCTION ops_assert_individual_privilege(p_scope text,p_action text,p_user uuid DEFAULT auth.uid()) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid:=current_tenant_id();
BEGIN
 IF NOT EXISTS(SELECT 1 FROM user_profiles WHERE id=p_user AND tenant_id=t AND lower(role) IN ('dokter','doctor','nurse','perawat','midwife','bidan','pharmacist','apoteker','lab','analis','clinical_governance')) THEN RAISE EXCEPTION 'Profesi individu tidak valid';END IF;
 IF NOT EXISTS(SELECT 1 FROM ops_individual_privileges g WHERE g.tenant_id=t AND g.user_id=p_user AND g.scope=p_scope AND g.actions ? p_action AND g.state='verified' AND current_date BETWEEN g.valid_from AND g.valid_until AND cardinality(g.credential_ids)>0 AND NOT EXISTS(SELECT 1 FROM unnest(g.credential_ids) src(source_id) LEFT JOIN ops_professional_credentials c ON c.id=src.source_id AND c.tenant_id=t AND c.user_id=p_user WHERE c.id IS NULL OR c.state<>'verified' OR current_date NOT BETWEEN c.valid_from AND c.valid_until)) THEN RAISE EXCEPTION 'Privilege individu/kredensial belum sah, kedaluwarsa atau dicabut';END IF;
END $$;
CREATE FUNCTION ops_workforce_command(p_entity text,p_action text,p_data jsonb,p_key text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid:=current_tenant_id();a uuid;subject uuid;c ops_professional_credentials;g ops_individual_privileges;q ops_workforce_requests;inp jsonb:=jsonb_build_object('entity',p_entity,'action',p_action,'data',p_data);res jsonb;before_value jsonb;from_value date;until_value date;ids bigint[];x jsonb;
BEGIN
 a:=ops_actor(ARRAY['super_admin','head_operation','direktur','admin_faskes','dokter','doctor','nurse','perawat','midwife','bidan','pharmacist','apoteker','lab','analis','clinical_governance']);
 IF p_entity IS NULL OR p_entity NOT IN ('credential','privilege') OR p_action IS NULL OR jsonb_typeof(p_data) IS DISTINCT FROM 'object' OR p_key IS NULL OR length(p_key) NOT BETWEEN 8 AND 150 OR coalesce(length(trim(p_data->>'reason')),0)<3 THEN RAISE EXCEPTION 'Input/request key/alasan wajib';END IF;
 PERFORM pg_advisory_xact_lock(hashtext(t::text||'workforce:'||p_key));SELECT * INTO q FROM ops_workforce_requests WHERE tenant_id=t AND request_key=p_key;
 IF FOUND THEN IF q.actor_id<>a OR q.input IS DISTINCT FROM inp THEN RAISE EXCEPTION 'Retry input/actor berbeda';END IF;RETURN q.result;END IF;
 IF p_action='create' THEN
  subject:=(p_data->>'user_id')::uuid;from_value:=(p_data->>'valid_from')::date;until_value:=(p_data->>'valid_until')::date;
  IF NOT EXISTS(SELECT 1 FROM user_profiles WHERE id=subject AND tenant_id=t AND lower(role) IN ('dokter','doctor','nurse','perawat','midwife','bidan','pharmacist','apoteker','lab','analis','clinical_governance')) THEN RAISE EXCEPTION 'Petugas profesi milik tenant wajib';END IF;
  IF from_value IS NULL OR until_value IS NULL OR until_value<from_value OR coalesce(length(trim(p_data->>'evidence')),0)<3 THEN RAISE EXCEPTION 'Periode dan bukti wajib';END IF;
  IF p_entity='credential' THEN
   IF p_data->>'kind' IS NULL OR p_data->>'kind' NOT IN ('STR','SIP','professional_authorization') OR coalesce(length(trim(p_data->>'reference')),0)<3 THEN RAISE EXCEPTION 'Jenis dan referensi kredensial wajib';END IF;
   INSERT INTO ops_professional_credentials(tenant_id,user_id,kind,reference,evidence,valid_from,valid_until,created_by,reason) VALUES(t,subject,p_data->>'kind',p_data->>'reference',p_data->>'evidence',from_value,until_value,a,p_data->>'reason') RETURNING * INTO c;res:=to_jsonb(c);
  ELSE
   IF coalesce(length(trim(p_data->>'scope')),0)<1 OR length(p_data->>'scope')>100 OR jsonb_typeof(p_data->'actions') IS DISTINCT FROM 'array' OR jsonb_array_length(p_data->'actions')=0 OR jsonb_typeof(p_data->'credential_ids') IS DISTINCT FROM 'array' OR jsonb_array_length(p_data->'credential_ids')=0 THEN RAISE EXCEPTION 'Scope, aksi dan kredensial eksplisit wajib';END IF;
   FOR x IN SELECT value FROM jsonb_array_elements(p_data->'actions') LOOP IF jsonb_typeof(x)<>'string' OR x#>>'{}' !~ '^clinical\.[a-z][a-z0-9_.]{0,90}$' THEN RAISE EXCEPTION 'Aksi privilege klinis tidak valid';END IF;END LOOP;
   SELECT array_agg(DISTINCT value::bigint) INTO ids FROM jsonb_array_elements_text(p_data->'credential_ids');
   IF EXISTS(SELECT 1 FROM unnest(ids) src(source_id) LEFT JOIN ops_professional_credentials cr ON cr.id=src.source_id AND cr.tenant_id=t AND cr.user_id=subject WHERE cr.id IS NULL OR cr.state<>'verified' OR cr.valid_from>from_value OR cr.valid_until<until_value) THEN RAISE EXCEPTION 'Kredensial sah harus mencakup seluruh periode privilege';END IF;
   INSERT INTO ops_individual_privileges(tenant_id,user_id,scope,actions,credential_ids,valid_from,valid_until,evidence,created_by,reason) VALUES(t,subject,p_data->>'scope',p_data->'actions',ids,from_value,until_value,p_data->>'evidence',a,p_data->>'reason') RETURNING * INTO g;res:=to_jsonb(g);
  END IF;
 ELSE
  IF p_entity='credential' THEN SELECT * INTO c FROM ops_professional_credentials WHERE id=(p_data->>'id')::bigint AND tenant_id=t FOR UPDATE;res:=to_jsonb(c);ELSE SELECT * INTO g FROM ops_individual_privileges WHERE id=(p_data->>'id')::bigint AND tenant_id=t FOR UPDATE;res:=to_jsonb(g);END IF;
  IF res->>'id' IS NULL THEN RAISE EXCEPTION 'Record tidak ditemukan';END IF;before_value:=res;
  IF (res->>'version')::integer IS DISTINCT FROM (p_data->>'version')::integer THEN RAISE EXCEPTION 'Data berubah; muat ulang';END IF;
  IF p_action='submit' AND res->>'state'='draft' THEN res:=res||jsonb_build_object('state','in_review');
  ELSIF p_action='approve' AND res->>'state'='in_review' THEN
   PERFORM ops_actor(ARRAY['clinical_governance','dokter','doctor']);
   IF (res->>'created_by')::uuid=a OR (res->>'user_id')::uuid=a THEN RAISE EXCEPTION 'Reviewer profesi harus berbeda dari pembuat dan pemilik';END IF;
   IF current_date>(res->>'valid_until')::date THEN RAISE EXCEPTION 'Record kedaluwarsa';END IF;
   IF p_entity='privilege' AND EXISTS(SELECT 1 FROM unnest(g.credential_ids) src(source_id) LEFT JOIN ops_professional_credentials cr ON cr.id=src.source_id WHERE cr.id IS NULL OR cr.state<>'verified' OR cr.valid_from>g.valid_from OR cr.valid_until<g.valid_until) THEN RAISE EXCEPTION 'Kredensial sumber tidak sah';END IF;
   res:=res||jsonb_build_object('state','verified','reviewed_by',a,'reviewed_at',now());
  ELSIF p_action='revoke' AND res->>'state' IN ('draft','in_review','verified') THEN
   PERFORM ops_actor(ARRAY['clinical_governance','dokter','doctor']);res:=res||jsonb_build_object('state','revoked');
  ELSE RAISE EXCEPTION 'Transisi workforce tidak sah';END IF;
  IF p_entity='credential' THEN UPDATE ops_professional_credentials SET state=res->>'state',reviewed_by=(res->>'reviewed_by')::uuid,reviewed_at=(res->>'reviewed_at')::timestamptz,version=version+1 WHERE id=c.id RETURNING * INTO c;res:=to_jsonb(c);ELSE UPDATE ops_individual_privileges SET state=res->>'state',reviewed_by=(res->>'reviewed_by')::uuid,reviewed_at=(res->>'reviewed_at')::timestamptz,version=version+1 WHERE id=g.id RETURNING * INTO g;res:=to_jsonb(g);END IF;
 END IF;
 INSERT INTO ops_workforce_events(tenant_id,entity,entity_id,actor_id,action,reason,before_row,after_row) VALUES(t,p_entity,(res->>'id')::bigint,a,p_action,p_data->>'reason',before_value,res);INSERT INTO ops_workforce_requests VALUES(t,p_key,a,inp,res);RETURN res;
END $$;
CREATE OR REPLACE FUNCTION ops_assert_permission(p_scope text,p_action text,p_creator uuid DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p jsonb;r jsonb;role_name text;
BEGIN
 PERFORM ops_actor();p:=ops_active_policy('authority',p_scope);SELECT value INTO r FROM jsonb_array_elements(p->'payload'->'rules') WHERE value->>'action'=p_action;SELECT lower(role) INTO role_name FROM user_profiles WHERE id=auth.uid() AND tenant_id=current_tenant_id();
 IF r IS NULL OR NOT(r->'roles' ? role_name) THEN RAISE EXCEPTION 'Kewenangan aksi belum disahkan';END IF;
 IF (r->>'separate_verifier')::boolean AND p_creator=auth.uid() THEN RAISE EXCEPTION 'Verifikator harus berbeda dari pelaksana';END IF;
 IF p_action LIKE 'clinical.%' THEN PERFORM ops_assert_individual_privilege(p_scope,p_action);END IF;
END $$;
ALTER FUNCTION ops_policy_command(bigint,text,jsonb,text) RENAME TO ops_policy_command_before_workforce;
REVOKE ALL ON FUNCTION ops_policy_command_before_workforce(bigint,text,jsonb,text) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION ops_policy_command(p_id bigint,p_action text,p_data jsonb,p_request_key text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p ops_policy_versions;clinical_kind boolean;
BEGIN
 IF p_id IS NOT NULL AND p_action IN ('approve','activate') THEN
  SELECT * INTO p FROM ops_policy_versions WHERE id=p_id AND tenant_id=current_tenant_id();
  clinical_kind:=p.kind='clinical_template' OR p.kind='authority' AND EXISTS(SELECT 1 FROM jsonb_array_elements(p.payload->'rules') r WHERE r->>'action' LIKE 'clinical.%');
  IF clinical_kind THEN PERFORM ops_assert_individual_privilege(p.scope,CASE WHEN p.kind='clinical_template' THEN 'clinical.template.review' ELSE 'clinical.authority.review' END,CASE WHEN p_action='approve' THEN auth.uid() ELSE p.reviewed_by END);END IF;
 END IF;
 RETURN ops_policy_command_before_workforce(p_id,p_action,p_data,p_request_key);
END $$;
CREATE FUNCTION ops_workforce_board(p_entity text,p_offset integer DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE rows_value jsonb;t uuid:=current_tenant_id();read_all boolean;
BEGIN
 PERFORM ops_actor(ARRAY['super_admin','head_operation','direktur','admin_faskes','dokter','doctor','nurse','perawat','midwife','bidan','pharmacist','apoteker','lab','analis','clinical_governance']);IF p_offset IS NULL OR p_offset<0 OR p_offset>1000000 OR p_entity IS NULL OR p_entity NOT IN ('credential','privilege') THEN RAISE EXCEPTION 'Entity/offset tidak valid';END IF;
 read_all:=current_app_role() IN ('super_admin','head_operation','direktur','admin_faskes','clinical_governance','dokter','doctor');
 IF p_entity='credential' THEN SELECT coalesce(jsonb_agg(to_jsonb(r)),'[]') INTO rows_value FROM (SELECT c.*,u.full_name FROM ops_professional_credentials c JOIN user_profiles u ON u.id=c.user_id WHERE c.tenant_id=t AND (read_all OR c.user_id=auth.uid()) ORDER BY c.id DESC LIMIT 51 OFFSET p_offset)r;ELSE SELECT coalesce(jsonb_agg(to_jsonb(r)),'[]') INTO rows_value FROM (SELECT g.*,u.full_name FROM ops_individual_privileges g JOIN user_profiles u ON u.id=g.user_id WHERE g.tenant_id=t AND (read_all OR g.user_id=auth.uid()) ORDER BY g.id DESC LIMIT 51 OFFSET p_offset)r;END IF;
 RETURN jsonb_build_object('rows',rows_value,'staff',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',full_name,'role',role)) FROM user_profiles WHERE tenant_id=t AND lower(role) IN ('dokter','doctor','nurse','perawat','midwife','bidan','pharmacist','apoteker','lab','analis','clinical_governance')),'[]'),'credentials',coalesce((SELECT jsonb_agg(to_jsonb(c)) FROM (SELECT id,user_id,kind,reference,valid_from,valid_until FROM ops_professional_credentials WHERE tenant_id=t AND (read_all OR user_id=auth.uid()) AND state='verified' AND current_date BETWEEN valid_from AND valid_until ORDER BY id DESC LIMIT 200)c),'[]'));
END $$;
DO $$DECLARE n text;BEGIN FOREACH n IN ARRAY ARRAY['ops_professional_credentials','ops_individual_privileges','ops_workforce_requests','ops_workforce_events'] LOOP EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',n);EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,anon,authenticated',n);END LOOP;END $$;
CREATE POLICY ops_credential_read ON ops_professional_credentials FOR SELECT TO authenticated USING(tenant_id=current_tenant_id() AND (user_id=auth.uid() OR current_app_role() IN ('super_admin','head_operation','direktur','admin_faskes','clinical_governance','dokter','doctor')));
CREATE POLICY ops_privilege_read ON ops_individual_privileges FOR SELECT TO authenticated USING(tenant_id=current_tenant_id() AND (user_id=auth.uid() OR current_app_role() IN ('super_admin','head_operation','direktur','admin_faskes','clinical_governance','dokter','doctor')));
GRANT SELECT ON ops_professional_credentials,ops_individual_privileges TO authenticated;
REVOKE ALL ON FUNCTION ops_assert_individual_privilege(text,text,uuid),ops_workforce_command(text,text,jsonb,text),ops_workforce_board(text,integer),ops_policy_command(bigint,text,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION ops_workforce_command(text,text,jsonb,text),ops_workforce_board(text,integer),ops_policy_command(bigint,text,jsonb,text) TO authenticated;
COMMIT;
