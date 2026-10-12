-- OWNED_BY: generic. Tenant operational bindings preserve the existing drug and batch keys.
-- Install with the subsequent Rx/MAR adapter, never as an isolated operational rollout.
BEGIN;
-- Named professional reviewers already pass the individual credential gate in 0081.
-- The older policy core must also recognize those professions instead of excluding them by role.
DO $$DECLARE body text;BEGIN
 SELECT pg_get_functiondef('ops_policy_command_before_workforce(bigint,text,jsonb,text)'::regprocedure) INTO body;
 IF position('''clinical_governance'',''doctor'',''dokter''' IN body)=0 THEN RAISE EXCEPTION 'Policy reviewer source contract changed';END IF;
 body:=replace(body,'''clinical_governance'',''dokter'',''doctor'',''tech''','''clinical_governance'',''dokter'',''doctor'',''tech'',''pharmacist'',''apoteker'',''nurse'',''perawat'',''midwife'',''bidan'',''lab'',''analis''');
 body:=replace(body,'''clinical_governance'',''doctor'',''dokter''','''clinical_governance'',''doctor'',''dokter'',''pharmacist'',''apoteker'',''nurse'',''perawat'',''midwife'',''bidan'',''lab'',''analis''');EXECUTE body;
 SELECT pg_get_functiondef('ops_policy_staff()'::regprocedure) INTO body;
 body:=replace(body,'''clinical_governance'',''dokter'',''doctor'',''tech''','''clinical_governance'',''dokter'',''doctor'',''tech'',''pharmacist'',''apoteker'',''nurse'',''perawat'',''midwife'',''bidan'',''lab'',''analis''');EXECUTE body;
END $$;
INSERT INTO role_pages(role_kode,page) SELECT kode,'cfg-rs-policy' FROM roles WHERE kode IN ('pharmacist','apoteker','nurse','perawat','midwife','bidan','lab','analis') ON CONFLICT DO NOTHING;
CREATE TABLE rs_pharmacy_bindings(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),drug_id bigint NOT NULL REFERENCES pharmacy_drugs(id),
 unit_price numeric NOT NULL CHECK(unit_price>=0),qty_step numeric NOT NULL CHECK(qty_step>0),amount_decimals integer NOT NULL CHECK(amount_decimals BETWEEN 0 AND 4),is_formulary boolean NOT NULL,timezone text NOT NULL,
 opening_batches jsonb NOT NULL,opening_snapshot jsonb NOT NULL,valid_until date NOT NULL,state text NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','active','rejected','revoked')),
 created_by uuid NOT NULL,reviewed_by uuid,version integer NOT NULL DEFAULT 1,evidence text NOT NULL,reason text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),reviewed_at timestamptz);
CREATE UNIQUE INDEX rs_pharmacy_one_binding ON rs_pharmacy_bindings(tenant_id,drug_id) WHERE state='active';
CREATE TABLE rs_pharmacy_batch_scopes(batch_id bigint PRIMARY KEY REFERENCES pharmacy_batches(id),tenant_id uuid NOT NULL REFERENCES tenants(id),binding_id bigint NOT NULL REFERENCES rs_pharmacy_bindings(id),assigned_by uuid NOT NULL,assigned_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE rs_pharmacy_requests(tenant_id uuid NOT NULL REFERENCES tenants(id),request_key text NOT NULL,actor_id uuid NOT NULL,input jsonb NOT NULL,result jsonb NOT NULL,PRIMARY KEY(tenant_id,request_key));
CREATE TABLE rs_pharmacy_events(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),actor_id uuid NOT NULL,action text NOT NULL,ref_id bigint,reason text NOT NULL,before_row jsonb,after_row jsonb,created_at timestamptz NOT NULL DEFAULT now());
CREATE FUNCTION rs_pharmacy_drug_snapshot(p_drug bigint) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('id',id,'drug_code',drug_code,'generic_name',generic_name,'brand_name',brand_name,'dosage_form',dosage_form,'strength',strength,'unit',unit,'drug_class',drug_class,'is_active',is_active) FROM pharmacy_drugs WHERE id=p_drug
$$;
CREATE FUNCTION rs_pharmacy_batch_snapshot(p_drug bigint,p_ids jsonb) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE ids bigint[];result_value jsonb;
BEGIN
 IF jsonb_typeof(p_ids) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Daftar batch opening eksplisit wajib';END IF;
 SELECT array_agg(value::bigint) INTO ids FROM jsonb_array_elements_text(p_ids);
 IF EXISTS(SELECT 1 FROM rs_pharmacy_batch_scopes WHERE batch_id=ANY(ids) AND tenant_id<>current_tenant_id()) THEN RAISE EXCEPTION 'Batch opening milik tenant lain';END IF;
 IF cardinality(ids)>10000 OR cardinality(ids) IS DISTINCT FROM (SELECT count(DISTINCT value)::integer FROM unnest(ids) value) AND cardinality(ids) IS NOT NULL THEN RAISE EXCEPTION 'ID batch duplikat/terlalu banyak';END IF;
 IF EXISTS(SELECT 1 FROM unnest(ids) src(id) LEFT JOIN pharmacy_batches b ON b.id=src.id AND b.drug_id=p_drug WHERE b.id IS NULL OR b.qty_remaining<0) THEN RAISE EXCEPTION 'Batch opening tidak sesuai source obat';END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(b) ORDER BY id),'[]') INTO result_value FROM pharmacy_batches b WHERE b.id=ANY(ids);RETURN result_value;
END $$;
CREATE FUNCTION rs_pharmacy_binding_command(p_action text,p_data jsonb,p_key text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid:=current_tenant_id();a uuid;b rs_pharmacy_bindings;d pharmacy_drugs;r rs_pharmacy_requests;
 input_value jsonb:=jsonb_build_object('binding_action',p_action,'data',p_data);result_value jsonb;before_value jsonb;batch_value jsonb;selected_batch bigint;
BEGIN
 a:=ops_actor(ARRAY['super_admin','head_operation','direktur','admin_faskes','apoteker','pharmacist','operasional']);
 IF jsonb_typeof(p_data) IS DISTINCT FROM 'object' OR p_key IS NULL OR length(p_key) NOT BETWEEN 8 AND 150 OR coalesce(length(trim(p_data->>'reason')),0)<3 THEN RAISE EXCEPTION 'Input/key/alasan wajib';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||p_key,0));SELECT * INTO r FROM rs_pharmacy_requests WHERE tenant_id=t AND request_key=p_key;
 IF FOUND THEN IF r.actor_id<>a OR r.input<>input_value THEN RAISE EXCEPTION 'Retry actor/input berbeda';END IF;RETURN r.result;END IF;
 IF p_action='create' THEN SELECT * INTO d FROM pharmacy_drugs WHERE id=(p_data->>'drug_id')::bigint AND is_active FOR UPDATE;
 ELSE SELECT * INTO b FROM rs_pharmacy_bindings WHERE id=(p_data->>'id')::bigint AND tenant_id=t;SELECT * INTO d FROM pharmacy_drugs WHERE id=b.drug_id FOR UPDATE;SELECT * INTO b FROM rs_pharmacy_bindings WHERE id=b.id FOR UPDATE;END IF;
 IF d.id IS NULL THEN RAISE EXCEPTION 'Obat aktif/binding source tidak ditemukan';END IF;before_value:=to_jsonb(b);
 IF NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=CASE WHEN p_action='create' THEN p_data->>'timezone' ELSE b.timezone END) THEN RAISE EXCEPTION 'Timezone binding eksplisit wajib';END IF;
 PERFORM set_config('TimeZone',CASE WHEN p_action='create' THEN p_data->>'timezone' ELSE b.timezone END,true);
 PERFORM ops_assert_permission('rs-ward-pharmacy',CASE WHEN p_action='approve' THEN 'clinical.formulary.review' ELSE 'pharmacy.binding.'||p_action END);
 IF p_action='create' THEN
  IF jsonb_typeof(p_data->'unit_price') IS DISTINCT FROM 'number' OR jsonb_typeof(p_data->'qty_step') IS DISTINCT FROM 'number' OR jsonb_typeof(p_data->'is_formulary') IS DISTINCT FROM 'boolean' OR (p_data->>'unit_price')::numeric<0 OR (p_data->>'qty_step')::numeric<=0 OR jsonb_typeof(p_data->'amount_decimals') IS DISTINCT FROM 'number' OR (p_data->>'amount_decimals')::numeric<>trunc((p_data->>'amount_decimals')::numeric) OR (p_data->>'amount_decimals')::numeric NOT BETWEEN 0 AND 4 OR (p_data->>'unit_price')::numeric<>round((p_data->>'unit_price')::numeric,(p_data->>'amount_decimals')::integer) OR (p_data->>'valid_until')::date<current_date OR coalesce(length(trim(p_data->>'evidence')),0)<3 THEN RAISE EXCEPTION 'Harga/formularium/presisi/langkah quantity/periode/bukti eksplisit wajib';END IF;
  batch_value:=rs_pharmacy_batch_snapshot(d.id,p_data->'opening_batches');
  INSERT INTO rs_pharmacy_bindings(tenant_id,drug_id,unit_price,qty_step,amount_decimals,is_formulary,timezone,opening_batches,opening_snapshot,valid_until,created_by,evidence,reason)
  VALUES(t,d.id,(p_data->>'unit_price')::numeric,(p_data->>'qty_step')::numeric,(p_data->>'amount_decimals')::integer,(p_data->>'is_formulary')::boolean,p_data->>'timezone',p_data->'opening_batches',jsonb_build_object('drug',rs_pharmacy_drug_snapshot(d.id),'batches',batch_value),(p_data->>'valid_until')::date,a,p_data->>'evidence',p_data->>'reason') RETURNING * INTO b;
 ELSIF p_action IN ('approve','reject','revoke') THEN
  IF b.version IS DISTINCT FROM (p_data->>'version')::integer OR b.state IS DISTINCT FROM (CASE WHEN p_action='revoke' THEN 'active' ELSE 'draft' END) THEN RAISE EXCEPTION 'Binding berubah/state tidak sesuai';END IF;
  IF b.created_by=a THEN RAISE EXCEPTION 'Reviewer binding harus berbeda';END IF;
  IF p_action='approve' THEN
   PERFORM 1 FROM pharmacy_drugs WHERE id=b.drug_id FOR UPDATE;
   PERFORM 1 FROM pharmacy_batches WHERE id IN (SELECT value::bigint FROM jsonb_array_elements_text(b.opening_batches)) ORDER BY id FOR UPDATE;
   IF lower(current_app_role()) NOT IN ('apoteker','pharmacist') THEN RAISE EXCEPTION 'Review formulary oleh apoteker';END IF;
   IF b.valid_until<current_date OR b.opening_snapshot IS DISTINCT FROM jsonb_build_object('drug',rs_pharmacy_drug_snapshot(d.id),'batches',rs_pharmacy_batch_snapshot(d.id,b.opening_batches)) THEN RAISE EXCEPTION 'Opening source berubah/kedaluwarsa';END IF;
   FOR selected_batch IN SELECT value::bigint FROM jsonb_array_elements_text(b.opening_batches) LOOP
    IF EXISTS(SELECT 1 FROM rs_pharmacy_batch_scopes WHERE batch_id=selected_batch AND tenant_id<>t) THEN RAISE EXCEPTION 'Batch opening milik tenant lain';END IF;
    INSERT INTO rs_pharmacy_batch_scopes(batch_id,tenant_id,binding_id,assigned_by) VALUES(selected_batch,t,b.id,a) ON CONFLICT(batch_id) DO UPDATE SET binding_id=EXCLUDED.binding_id,assigned_by=EXCLUDED.assigned_by,assigned_at=now();
   END LOOP;
  END IF;
  UPDATE rs_pharmacy_bindings SET state=CASE p_action WHEN 'approve' THEN 'active' WHEN 'reject' THEN 'rejected' ELSE 'revoked' END,reviewed_by=a,reviewed_at=now(),version=version+1 WHERE id=b.id RETURNING * INTO b;
 ELSE RAISE EXCEPTION 'Aksi binding tidak dikenal';END IF;
 result_value:=to_jsonb(b);INSERT INTO rs_pharmacy_events(tenant_id,actor_id,action,ref_id,reason,before_row,after_row) VALUES(t,a,'binding.'||p_action,b.id,p_data->>'reason',before_value,result_value);INSERT INTO rs_pharmacy_requests VALUES(t,p_key,a,input_value,result_value);RETURN result_value;
END $$;
DO $$DECLARE n text;BEGIN FOREACH n IN ARRAY ARRAY['rs_pharmacy_bindings','rs_pharmacy_batch_scopes','rs_pharmacy_requests','rs_pharmacy_events'] LOOP EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',n);EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,anon,authenticated',n);END LOOP;END $$;
CREATE POLICY rs_pharmacy_binding_read ON rs_pharmacy_bindings FOR SELECT TO authenticated USING(tenant_id=current_tenant_id() AND rs_can_read('rs-ward-pharmacy'));GRANT SELECT ON rs_pharmacy_bindings TO authenticated;
REVOKE ALL ON FUNCTION rs_pharmacy_drug_snapshot(bigint),rs_pharmacy_batch_snapshot(bigint,jsonb),rs_pharmacy_binding_command(text,jsonb,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION rs_pharmacy_drug_snapshot(bigint),rs_pharmacy_batch_snapshot(bigint,jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION rs_pharmacy_binding_command(text,jsonb,text) TO authenticated;
COMMIT;
