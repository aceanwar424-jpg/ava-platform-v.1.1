-- OWNED_BY: generic. Preserve policy IDs/revisions and independent clinical review.
BEGIN;
CREATE FUNCTION rs_clinical_assert_amendment_template(p_old bigint,p_new bigint) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE oldp ops_policy_versions;newp ops_policy_versions;
BEGIN
 SELECT * INTO oldp FROM ops_policy_versions WHERE id=p_old AND tenant_id=current_tenant_id();SELECT * INTO newp FROM ops_policy_versions WHERE id=p_new AND tenant_id=current_tenant_id();
 IF oldp.id IS NULL OR newp.id IS NULL OR oldp.scope IS DISTINCT FROM newp.scope OR coalesce(nullif(oldp.payload->>'purpose',''),'legacy') IS DISTINCT FROM coalesce(nullif(newp.payload->>'purpose',''),'legacy') OR (nullif(oldp.payload->>'form_code','') IS NOT NULL AND nullif(newp.payload->>'form_code','') IS NOT NULL AND oldp.payload->>'form_code' IS DISTINCT FROM newp.payload->>'form_code') THEN RAISE EXCEPTION 'Purpose/form code amendment harus sesuai sumber';END IF;
END $$;
DO $$DECLARE signature text;body text;needle text;BEGIN
 FOREACH signature IN ARRAY ARRAY['rs_mar_command_before_original_guard(text,jsonb,text)','rs_inpatient_discharge_command(text,jsonb,text)'] LOOP
  IF to_regprocedure(signature) IS NULL THEN CONTINUE;END IF;
  SELECT pg_get_functiondef(signature::regprocedure) INTO body;
  needle:='role_name WHERE role_name NOT IN (''dokter'',''doctor'')';
  IF position(needle IN body)=0 THEN RAISE EXCEPTION 'Clinical source signer role contract changed: %',signature;END IF;
  body:=replace(body,needle,'role_name WHERE ops_professional_role(role_name) NOT IN (''dokter'',''doctor'')');EXECUTE body;
 END LOOP;
END $$;
DO $$DECLARE body text;needle text;BEGIN
 SELECT pg_get_functiondef('rs_clinical_command(text,jsonb,text)'::regprocedure) INTO body;
 needle:='IF (SELECT scope FROM ops_policy_versions WHERE id=oldr.policy_id) IS DISTINCT FROM p.scope';
 IF position(needle IN body)=0 THEN RAISE EXCEPTION 'Clinical amendment source contract changed';END IF;
 body:=replace(body,needle,'IF EXISTS(SELECT 1 FROM rs_clinical_records WHERE amendment_of=oldr.id AND tenant_id=t AND signed_at IS NOT NULL) THEN RAISE EXCEPTION ''Source amendment bukan head signed terbaru'';END IF; PERFORM rs_clinical_assert_amendment_template(oldr.policy_id,p.id); '||needle);
 needle:='SELECT * INTO oldr FROM rs_clinical_records WHERE id=(p_data->>''amendment_of'')::bigint AND tenant_id=t;';
 IF position(needle IN body)=0 THEN RAISE EXCEPTION 'Clinical amendment parent source contract changed';END IF;
 body:=replace(body,needle,replace(needle,';',' FOR SHARE;'));
 needle:='-- A record retains its approved version even if a replacement becomes active.';
 IF position(needle IN body)=0 THEN RAISE EXCEPTION 'Clinical signing source contract changed';END IF;
 body:=replace(body,needle,'IF r.amendment_of IS NOT NULL THEN PERFORM 1 FROM rs_clinical_records WHERE id=r.amendment_of AND tenant_id=t FOR UPDATE;IF EXISTS(SELECT 1 FROM rs_clinical_records WHERE amendment_of=r.amendment_of AND tenant_id=t AND id<>r.id AND signed_at IS NOT NULL) THEN RAISE EXCEPTION ''Source amendment bukan head signed terbaru'';END IF;END IF; '||needle);EXECUTE body;
END $$;
DO $$DECLARE body text;needle text;BEGIN
 IF to_regprocedure('rs_mar_command(text,jsonb,text)') IS NULL THEN RETURN;END IF;
 SELECT pg_get_functiondef('rs_mar_command_before_original_guard(text,jsonb,text)'::regprocedure) INTO body;
 needle:='PERFORM ops_actor(ARRAY[''nurse'',''perawat'']);due_value:=';
 IF position(needle IN body)=0 THEN RAISE EXCEPTION 'MAR administration source record contract changed';END IF;
 body:=replace(body,needle,'PERFORM 1 FROM rs_clinical_records WHERE id=plan.clinical_record_id AND tenant_id=t FOR SHARE;IF EXISTS(SELECT 1 FROM rs_clinical_records WHERE amendment_of=plan.clinical_record_id AND tenant_id=t AND signed_at IS NOT NULL) THEN RAISE EXCEPTION ''Instruksi jadwal sudah diamend; dokter harus stop dan jadwalkan ulang'';END IF; '||needle);EXECUTE body;
END $$;
ALTER FUNCTION ops_validate_policy(text,jsonb) RENAME TO ops_validate_policy_before_clinical_metadata;
CREATE FUNCTION ops_validate_policy(p_kind text,p jsonb) RETURNS void LANGUAGE plpgsql SET search_path=public AS $$
DECLARE purpose text:=p->>'purpose';key_name text;field_type text;v text;
BEGIN
 PERFORM ops_validate_policy_before_clinical_metadata(p_kind,p);
 IF p_kind<>'clinical_template' THEN RETURN;END IF;
 IF purpose IN ('medication_schedule','medication_custody','medication_administration_correction','inpatient_discharge') THEN
  IF NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p->>'timezone') THEN RAISE EXCEPTION 'Timezone SOP klinis wajib';END IF;
  IF purpose IN ('medication_schedule','inpatient_discharge') AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(p->'signer_roles') role_name WHERE ops_professional_role(role_name)<>'doctor') THEN RAISE EXCEPTION 'SOP keputusan dokter wajib profesi dokter';END IF;
 END IF;
 IF purpose='medication_schedule' THEN
  FOREACH key_name IN ARRAY ARRAY['early_minutes','late_minutes'] LOOP IF jsonb_typeof(p->key_name) IS DISTINCT FROM 'number' OR (p->>key_name)::numeric<0 THEN RAISE EXCEPTION 'Window SOP wajib nonnegative eksplisit';END IF;END LOOP;
  IF jsonb_typeof(p->'allow_fractional_stock_units') IS DISTINCT FROM 'boolean' OR jsonb_typeof(p->'administration_qty_decimals') IS DISTINCT FROM 'number' OR (p->>'administration_qty_decimals')::numeric<>trunc((p->>'administration_qty_decimals')::numeric) OR (p->>'administration_qty_decimals')::numeric NOT BETWEEN 0 AND 6 OR jsonb_typeof(p->'identity_fields') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Fraction/precision/identity SOP wajib eksplisit';END IF;
  IF jsonb_array_length(p->'identity_fields')<2 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p->'identity_fields') x WHERE jsonb_typeof(x)<>'string' OR coalesce(length(trim(x#>>'{}')),0)=0) OR (SELECT count(DISTINCT value) FROM jsonb_array_elements(p->'identity_fields'))<>jsonb_array_length(p->'identity_fields') THEN RAISE EXCEPTION 'Dua identitas SOP berbeda wajib';END IF;
  FOREACH key_name IN ARRAY ARRAY['rx_item_id','dispense_item_id','quantity_stock_units','due_times','route'] LOOP
   field_type:=CASE WHEN key_name IN ('due_times','route') THEN 'text' ELSE 'number' END;
   IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p->'fields') f WHERE f->>'key'=key_name AND f->>'type'=field_type AND f->'required'='true'::jsonb) THEN RAISE EXCEPTION 'Field source schedule wajib: % (%)',key_name,field_type;END IF;
  END LOOP;
 ELSIF purpose='medication_custody' THEN
  FOREACH key_name IN ARRAY ARRAY['allow_return','allow_waste','allow_take_home','waste_billable'] LOOP IF jsonb_typeof(p->key_name) IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Flags custody SOP eksplisit wajib';END IF;END LOOP;
  IF jsonb_typeof(p->'quantity_decimals') IS DISTINCT FROM 'number' OR (p->>'quantity_decimals')::numeric<>trunc((p->>'quantity_decimals')::numeric) OR (p->>'quantity_decimals')::numeric NOT BETWEEN 0 AND 6 THEN RAISE EXCEPTION 'Presisi custody 0–6 integer wajib';END IF;
 ELSIF purpose='inpatient_discharge' THEN
  IF jsonb_typeof(p->'decision_valid_minutes') IS DISTINCT FROM 'number' OR (p->>'decision_valid_minutes')::numeric<=0 THEN RAISE EXCEPTION 'Masa berlaku keputusan positif eksplisit wajib';END IF;
  FOREACH key_name IN ARRAY ARRAY['final_diagnosis','treatment_summary','discharge_medication','discharge_instruction','condition_on_discharge','exit_kind'] LOOP IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p->'fields') f WHERE f->>'key'=key_name AND f->>'type'='text' AND f->'required'='true'::jsonb) THEN RAISE EXCEPTION 'Field source discharge wajib: %',key_name;END IF;END LOOP;
 ELSIF purpose='medication_administration_correction' THEN
  FOREACH key_name IN ARRAY ARRAY['source_event_id','new_outcome'] LOOP field_type:=CASE key_name WHEN 'source_event_id' THEN 'number' ELSE 'text' END;IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p->'fields') f WHERE f->>'key'=key_name AND f->>'type'=field_type AND f->'required'='true'::jsonb) THEN RAISE EXCEPTION 'Field source correction wajib: %',key_name;END IF;END LOOP;
 END IF;
END $$;
CREATE FUNCTION rs_clinical_form_board(p_admission bigint,p_record_offset integer DEFAULT 0,p_template_offset integer DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid:=current_tenant_id();v jsonb;templates jsonb;
BEGIN
 PERFORM ops_actor(ARRAY['doctor','dokter','nurse','perawat','midwife','bidan','pharmacist','apoteker','lab','analis','clinical_governance']);
 IF p_record_offset IS NULL OR p_template_offset IS NULL OR p_record_offset<0 OR p_template_offset<0 OR p_record_offset>1000000 OR p_template_offset>1000000 THEN RAISE EXCEPTION 'Offset tidak valid';END IF;
 IF NOT EXISTS(SELECT 1 FROM admissions WHERE id=p_admission AND tenant_id=t) THEN RAISE EXCEPTION 'Kunjungan bukan milik tenant';END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('has_signed_amendment',EXISTS(SELECT 1 FROM rs_clinical_records child WHERE child.amendment_of=r.id AND child.signed_at IS NOT NULL),'template',jsonb_build_object('id',p.id,'scope',p.scope,'revision',p.revision,'title',p.payload->>'title','purpose',p.payload->>'purpose','form_code',p.payload->>'form_code','fields',p.payload->'fields')) ORDER BY r.id DESC),'[]') INTO v FROM(SELECT * FROM rs_clinical_records WHERE admission_id=p_admission AND tenant_id=t AND rs_clinical_can_read(policy_id) ORDER BY id DESC LIMIT 51 OFFSET p_record_offset)r JOIN ops_policy_versions p ON p.id=r.policy_id;
 SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY effective_at DESC,revision DESC,id DESC),'[]') INTO templates FROM(SELECT * FROM ops_policy_versions WHERE tenant_id=t AND kind='clinical_template' AND state='active' AND effective_at<=now() AND rs_clinical_can_read(id) ORDER BY effective_at DESC,revision DESC,id DESC LIMIT 51 OFFSET p_template_offset)p;
 RETURN jsonb_build_object('records',v,'templates',templates);
END $$;
CREATE FUNCTION rs_clinical_amendment_choices(p_record bigint,p_offset integer DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid:=current_tenant_id();oldp ops_policy_versions;r rs_clinical_records;v jsonb;
BEGIN
 PERFORM ops_actor(ARRAY['doctor','dokter','nurse','perawat','midwife','bidan','pharmacist','apoteker','lab','analis','clinical_governance']);
 IF p_offset IS NULL OR p_offset<0 OR p_offset>1000000 THEN RAISE EXCEPTION 'Offset tidak valid';END IF;
 SELECT * INTO r FROM rs_clinical_records WHERE id=p_record AND tenant_id=t AND signed_at IS NOT NULL AND rs_clinical_can_read(policy_id);IF NOT FOUND THEN RAISE EXCEPTION 'Source catatan signed tidak ditemukan';END IF;SELECT * INTO oldp FROM ops_policy_versions WHERE id=r.policy_id;
 SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY effective_at DESC,revision DESC,id DESC),'[]') INTO v FROM(SELECT * FROM ops_policy_versions WHERE tenant_id=t AND kind='clinical_template' AND scope=oldp.scope AND state='active' AND effective_at<=now() AND rs_clinical_can_read(id) AND coalesce(nullif(payload->>'purpose',''),'legacy')=coalesce(nullif(oldp.payload->>'purpose',''),'legacy') AND (nullif(payload->>'form_code','') IS NULL OR nullif(oldp.payload->>'form_code','') IS NULL OR payload->>'form_code'=oldp.payload->>'form_code') ORDER BY effective_at DESC,revision DESC,id DESC LIMIT 51 OFFSET p_offset)p;
 RETURN jsonb_build_object('templates',v);
END $$;
REVOKE ALL ON FUNCTION rs_clinical_assert_amendment_template(bigint,bigint),ops_validate_policy_before_clinical_metadata(text,jsonb),ops_validate_policy(text,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION rs_clinical_form_board(bigint,integer,integer),rs_clinical_amendment_choices(bigint,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION rs_clinical_form_board(bigint,integer,integer),rs_clinical_amendment_choices(bigint,integer) TO authenticated;
COMMIT;
