-- OWNED_BY: generic. Recognize existing LIS profession codes; authority roles still match exactly.
BEGIN;
CREATE FUNCTION ops_professional_role(p_role text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT CASE lower(p_role)
  WHEN 'dokter' THEN 'doctor' WHEN 'doctor_sppk' THEN 'doctor' WHEN 'sp_pk' THEN 'doctor'
  WHEN 'analis' THEN 'lab' WHEN 'lab_analyst' THEN 'lab' WHEN 'lab_supervisor' THEN 'lab'
  WHEN 'perawat' THEN 'nurse' WHEN 'bidan' THEN 'midwife' WHEN 'apoteker' THEN 'pharmacist'
  ELSE lower(p_role) END
$$;
CREATE OR REPLACE FUNCTION ops_actor(p_roles text[] DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r text;t uuid:=current_tenant_id();
BEGIN
 SELECT lower(role) INTO r FROM user_profiles WHERE id=auth.uid() AND tenant_id=t;
 IF auth.uid() IS NULL OR t IS NULL OR r IS NULL THEN RAISE EXCEPTION 'Login dan tenant aktif diperlukan';END IF;
 IF p_roles IS NOT NULL AND NOT EXISTS(SELECT 1 FROM unnest(p_roles) allowed(role_name) WHERE ops_professional_role(allowed.role_name)=ops_professional_role(r)) THEN RAISE EXCEPTION 'Peran tidak berwenang';END IF;
 RETURN auth.uid();
END $$;
CREATE OR REPLACE FUNCTION ops_assert_individual_privilege(p_scope text,p_action text,p_user uuid DEFAULT auth.uid()) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid:=current_tenant_id();g ops_individual_privileges;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM user_profiles WHERE id=p_user AND tenant_id=t AND ops_professional_role(role) IN ('doctor','nurse','midwife','pharmacist','lab','clinical_governance')) THEN RAISE EXCEPTION 'Profesi individu tidak valid';END IF;
 SELECT grant_row.* INTO g FROM ops_individual_privileges grant_row
 WHERE grant_row.tenant_id=t AND grant_row.user_id=p_user AND grant_row.scope=p_scope AND grant_row.actions ? p_action AND grant_row.state='verified' AND current_date BETWEEN grant_row.valid_from AND grant_row.valid_until AND cardinality(grant_row.credential_ids)>0
  AND NOT EXISTS(SELECT 1 FROM unnest(grant_row.credential_ids) source(source_id) LEFT JOIN ops_professional_credentials c ON c.id=source.source_id AND c.tenant_id=t AND c.user_id=p_user WHERE c.id IS NULL OR c.state<>'verified' OR current_date NOT BETWEEN c.valid_from AND c.valid_until)
 ORDER BY grant_row.id LIMIT 1 FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Privilege individu/kredensial belum sah, kedaluwarsa atau dicabut';END IF;
 -- Grant then sorted credentials, same order as registry grant review. Check again after a wait.
 PERFORM 1 FROM ops_professional_credentials WHERE id=ANY(g.credential_ids) ORDER BY id FOR SHARE;
 IF EXISTS(SELECT 1 FROM unnest(g.credential_ids) source(source_id) LEFT JOIN ops_professional_credentials c ON c.id=source.source_id AND c.tenant_id=t AND c.user_id=p_user WHERE c.id IS NULL OR c.state<>'verified' OR current_date NOT BETWEEN c.valid_from AND c.valid_until) THEN RAISE EXCEPTION 'Kredensial sumber berubah/dicabut; ulangi setelah review';END IF;
END $$;
DO $$DECLARE signature text;body text;needle text;BEGIN
 FOREACH signature IN ARRAY ARRAY['ops_workforce_command(text,text,jsonb,text)','ops_workforce_board(text,integer)'] LOOP
  SELECT pg_get_functiondef(signature::regprocedure) INTO body;
  IF position('lower(role) IN' IN body)=0 THEN RAISE EXCEPTION 'Registry source role contract changed: %',signature;END IF;
  body:=replace(body,'lower(role) IN','ops_professional_role(role) IN');
  IF signature='ops_workforce_board(text,integer)' THEN body:=replace(body,'current_app_role() IN','ops_professional_role(current_app_role()) IN');END IF;
  IF signature='ops_workforce_command(text,text,jsonb,text)' THEN
   needle:='IF p_entity=''privilege'' AND EXISTS(SELECT 1 FROM unnest(g.credential_ids)';
   IF position(needle IN body)=0 THEN RAISE EXCEPTION 'Workforce review credential source contract changed';END IF;
   body:=replace(body,needle,'IF p_entity=''privilege'' THEN PERFORM 1 FROM ops_professional_credentials WHERE id=ANY(g.credential_ids) ORDER BY id FOR SHARE;END IF; '||needle);
  END IF;
  EXECUTE body;
 END LOOP;
 SELECT pg_get_functiondef('ops_validate_policy_v1(text,jsonb)'::regprocedure) INTO body;
 needle:='x#>>''{}'' NOT IN (''dokter'',''doctor''';
 IF position(needle IN body)=0 THEN RAISE EXCEPTION 'Policy profession source contract changed';END IF;
 body:=replace(body,needle,'ops_professional_role(x#>>''{}'') NOT IN (''dokter'',''doctor''');EXECUTE body;
END $$;
REVOKE ALL ON FUNCTION ops_professional_role(text) FROM PUBLIC,anon,authenticated;
INSERT INTO role_pages(role_kode,page) SELECT r.kode,p.page FROM roles r CROSS JOIN (VALUES('cfg-practitioner'),('cfg-rs-policy'),('catalog-export'))p(page) WHERE r.kode IN ('lab_analyst','lab_supervisor','doctor_sppk','sp_pk') ON CONFLICT DO NOTHING;
COMMIT;
